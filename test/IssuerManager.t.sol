// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { Test } from "lib/forge-std/src/Test.sol";
import { IssuerManager } from "../contracts/IssuerManager.sol";

contract IssuerManagerTest is Test {
    IssuerManager issuerManager;
    address owner = address(0xABCD);
    address nonOwner = address(0x1234);
    address issuer1 = address(0x1111);
    address issuer2 = address(0x2222);

    function setUp() public {
        issuerManager = new IssuerManager();
    }

    // Verifica che l’owner iniziale del contratto sia il deployer.
    function testInitialOwnerIsDeployer() public view {
        assertEq(issuerManager.owner(), address(this));
    }

    // Controlla che l’owner possa trasferire la proprietà del contratto.
    function testOwnerCanTransferOwnership() public {
        issuerManager.transferOwnership(owner);
        assertEq(issuerManager.owner(), owner);
    }

    // Verifica che un indirizzo non proprietario non possa trasferire la proprietà.
    function testNonOwnerCannotTransferOwnership() public {
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: not owner");
        issuerManager.transferOwnership(nonOwner);
    }

    // Testa l’aggiunta e la rimozione di issuer da parte dell’owner.
    function testOwnerCanAddIssuer() public {
        issuerManager.setIssuer(issuer1, true);
        assertTrue(issuerManager.isIssuer(issuer1));
    }

    // Verifica che un indirizzo non proprietario non possa aggiungere issuer.
    function testNonOwnerCannotAddIssuer() public {
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: not owner");
        issuerManager.setIssuer(issuer1, true);
    }

    // Verifica che l’owner possa rimuovere issuer.
    function testOwnerCanRemoveIssuer() public {
        issuerManager.setIssuer(issuer1, true);
        issuerManager.setIssuer(issuer1, false);
        assertFalse(issuerManager.isIssuer(issuer1));
    }

    // Verifica che un indirizzo non proprietario non possa rimuovere issuer.
    function testNonOwnerCannotRemoveIssuer() public {
        issuerManager.setIssuer(issuer1, true);
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: not owner");
        issuerManager.setIssuer(issuer1, false);
    }

    // Verifica che l’aggiunta e la rimozione di issuer funzioni correttamente.
    function testIssuerStateChange() public {
        issuerManager.setIssuer(issuer1, true);
        assertTrue(issuerManager.isIssuer(issuer1));
        issuerManager.setIssuer(issuer1, false);
        assertFalse(issuerManager.isIssuer(issuer1));
    }

    // Verifica che l’aggiunta dello stesso issuer più volte non causi problemi.
    function testDoubleAddIssuer() public {
        issuerManager.setIssuer(issuer1, true);
        issuerManager.setIssuer(issuer1, true);
        assertTrue(issuerManager.isIssuer(issuer1));
    }

    // Verifica che la rimozione dello stesso issuer più volte non causi problemi.  
    function testDoubleRemoveIssuer() public {
        issuerManager.setIssuer(issuer1, true);
        issuerManager.setIssuer(issuer1, false);
        issuerManager.setIssuer(issuer1, false);
        assertFalse(issuerManager.isIssuer(issuer1));
    }

    // Verifica che il modifier onlyIssuer funzioni correttamente.
    function testOnlyIssuerModifier() public {
        issuerManager.setIssuer(issuer1, true);
        vm.prank(issuer1);
        // Funzione fittizia per testare il modifier
        // issuerManager.onlyIssuerFunction(); // Da implementare se esiste una funzione riservata agli issuer
        // Se non esiste, questo test è solo dimostrativo
    }
}
